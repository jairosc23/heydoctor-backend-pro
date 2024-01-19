/*
Designing an application that encrypts and decrypts data on demand over API requests using the Diffie-Hellman encryption method involves careful consideration of security, usability, and efficiency. Below is a suggested interaction flow for such an application:

Key Exchange:

The client and server initiate a Diffie-Hellman key exchange to securely establish a shared secret.
The server generates a long-term private key and corresponding public key.
The client generates a long-term private key and corresponding public key.
The client and server exchange public keys.
Both parties independently compute the shared secret using their private key and the received public key.

Authentication:

Implement a secure authentication mechanism to ensure that both the client and server are legitimate.
Use a combination of secure channels, such as HTTPS, and possibly additional authentication tokens or methods.
API Requests:

When the client wants to send encrypted data, it generates a session key for that specific interaction.
The client and server use the previously established shared secret to derive the session key independently.
The client sends a request to the server, including information about the desired action and the encrypted data.
Use standard API security practices (e.g., API keys, OAuth tokens) along with encrypted communication.

Server Processing:

Upon receiving the API request, the server uses its private key and the client's public key to derive the session key.
Decrypt the data using the session key.
Process the decrypted data according to the requested action.
Response:

If the server needs to send encrypted data back to the client, it generates a new session key for that interaction.
The server encrypts the response using the session key and sends it back to the client.
The client uses the session key to decrypt the response.
Error Handling:

Implement proper error handling mechanisms to deal with situations such as key exchange failure, decryption errors, or authentication issues.
Session Management:

Consider implementing session management to handle the lifecycle of the Diffie-Hellman key exchange and session keys. This may include expiring and refreshing keys for added security.
Logging and Monitoring:

Implement logging to track key exchange, encryption, and decryption events for security audits.
Set up monitoring to detect any suspicious activities or potential security breaches.
Documentation:

Provide clear documentation for developers using your API, explaining the key exchange process, encryption/decryption methods, and any other relevant information.
Testing:

Thoroughly test the entire process, including key exchange, encryption, and decryption, to ensure the security and reliability of your system.
*/

"use strict";

const crypto = require("crypto");
const { promisify } = require("util");
const randomBytesAsync = promisify(crypto.randomBytes);

/**
 * `encryption` middleware
 */

/**
 * Create diffieHellman keys
 * @Return: `Object` containing private and public keys
 */
const generateDiffieHellmanKeys = async () => {
  const diffieHellman = await crypto.createDiffieHellman(2048);
  diffieHellman.generateKeys("hex");
  return {
    publicKey: diffieHellman.getPublicKey("hex"),
    privateKey: diffieHellman.getPrivateKey("hex"),
  };
};

/**
 * Derive shared secret from client's public key and server's private key
 * @Return: `String` shared secret used for encryption and decryption
 */

const deriveSharedSecret = async (otherPartyPublicKey, ownPrivateKey) => {
  const diffieHellman = await crypto.createDiffieHellman(2048);
  diffieHellman.setPrivateKey(ownPrivateKey, "hex");
  return diffieHellman.computeSecret(otherPartyPublicKey, "hex", "hex");
};

/**
 * Creates a session key based on the derived shared secret
 * @Return: `String` used to secure the data exchanged during that specific interaction.
 */

const createSessionKey = (sharedSecret) => {
  const sessionKey = crypto
    .createHash("sha256")
    .update(sharedSecret)
    .digest("hex")
    .slice(0, 32);

  return sessionKey;
};

/**
 * Decrypt encrypted data
 * @param data: data to encrypt
 * @param sessionKey: sessionKey exchange
 * @Return: `Object` containing Initialization Vector and encrypted data output
 */
const encryptData = async (data, sessionKey) => {
  const iv = await randomBytesAsync(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(sessionKey, "hex"),
    iv
  );
  let encryptedData = cipher.update(JSON.stringify(data), "utf-8", "hex");
  encryptedData += cipher.final("hex");
  return { iv: iv.toString("hex"), encryptedData };
};

/**
 * Decrypt encrypted data
 * @param encryptedData: data to decrypt
 * @param key: shared secret exchange from sessionKey
 * @param iv: Initialization Vector used at the moment of encryption
 * @Return: decrypted data
 */
const decryptData = async (encryptedData, key, iv) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex")
  );
  let decryptedData = decipher.update(encryptedData, "hex", "utf8");
  decryptedData += decipher.final("utf8");
  return decryptedData;
};

module.exports = {
  generateDiffieHellmanKeys,
  deriveSharedSecret,
  createSessionKey,
  encryptData,
  decryptData,
};
