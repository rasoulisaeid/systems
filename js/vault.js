/* Vault — app-level password + real AES-GCM encryption via key-wrapping.
 *
 * A random 256-bit master key encrypts your data. Your password only *wraps*
 * (encrypts) that master key, using a PBKDF2-derived key. So:
 *   • The password itself is never stored anywhere (not locally, not on Firebase).
 *   • Only the wrapped key + salt + iv are stored — useless without the password.
 *   • Changing the password just re-wraps the same master key; data isn't touched.
 *   • A wrong password simply fails to unwrap (AES-GCM auth tag won't verify).
 *
 * The master key lives in memory only while unlocked; a reload re-locks it.
 * Because the wrapped key may sync to a shared DB, we use a high iteration
 * count and store it, so it can be raised later without breaking old vaults. */
(function () {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const K_SALT = "vault:salt";
  const K_IV   = "vault:iv";
  const K_WRAP = "vault:wrapped";
  const K_ITER = "vault:iter";
  const ITERATIONS = 600000;         // OWASP-tier (data may live on an open DB)

  let masterKey = null;              // CryptoKey, present only while unlocked
  const listeners = [];
  function notify() { listeners.forEach((fn) => { try { fn(); } catch (e) {} }); }

  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveWrappingKey(password, salt, iterations) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  function importMaster(raw) {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  function hasPassword() { return !!(window.Store.get(K_WRAP, null) && window.Store.get(K_SALT, null)); }
  function isUnlocked() { return !!masterKey; }

  async function setPassword(password) {
    if (hasPassword()) throw new Error("Password already set");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await deriveWrappingKey(password, salt, ITERATIONS);
    const mk = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const rawMk = await crypto.subtle.exportKey("raw", mk);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, rawMk);
    window.Store.set(K_SALT, b64(salt));
    window.Store.set(K_IV, b64(iv));
    window.Store.set(K_WRAP, b64(wrapped));
    window.Store.set(K_ITER, ITERATIONS);
    masterKey = await importMaster(rawMk);
    notify();
  }

  async function unlock(password) {
    if (!hasPassword()) return false;
    const salt = unb64(window.Store.get(K_SALT));
    const iv = unb64(window.Store.get(K_IV));
    const wrapped = unb64(window.Store.get(K_WRAP));
    const iterations = window.Store.get(K_ITER, ITERATIONS);
    const wrappingKey = await deriveWrappingKey(password, salt, iterations);
    let rawMk;
    try { rawMk = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, wrappingKey, wrapped); }
    catch (e) { return false; }      // wrong password
    masterKey = await importMaster(rawMk);
    notify();
    return true;
  }

  async function changePassword(current, next) {
    if (!hasPassword()) { await setPassword(next); return true; }
    const salt = unb64(window.Store.get(K_SALT));
    const iv = unb64(window.Store.get(K_IV));
    const wrapped = unb64(window.Store.get(K_WRAP));
    const iterations = window.Store.get(K_ITER, ITERATIONS);
    const oldWrapping = await deriveWrappingKey(current, salt, iterations);
    let rawMk;
    try { rawMk = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, oldWrapping, wrapped); }
    catch (e) { return false; }      // wrong current password
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newWrapping = await deriveWrappingKey(next, newSalt, ITERATIONS);
    const newIv = crypto.getRandomValues(new Uint8Array(12));
    const newWrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: newIv }, newWrapping, rawMk);
    window.Store.set(K_SALT, b64(newSalt));
    window.Store.set(K_IV, b64(newIv));
    window.Store.set(K_WRAP, b64(newWrapped));
    window.Store.set(K_ITER, ITERATIONS);
    masterKey = await importMaster(rawMk); // stay unlocked (same master key)
    notify();
    return true;
  }

  function lock() { masterKey = null; notify(); }

  async function encrypt(obj) {
    if (!masterKey) throw new Error("Vault is locked");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, masterKey, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(blob) {
    if (!masterKey) throw new Error("Vault is locked");
    if (!blob || !blob.iv || !blob.ct) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, masterKey, unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  }

  window.Vault = {
    hasPassword, isUnlocked, setPassword, unlock, changePassword, lock, encrypt, decrypt,
    onChange(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
  };
})();
