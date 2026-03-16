import argon2 from "argon2";

/**
 * Hash a password using Argon2id
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  try {
    // Argon2id with secure defaults:
    // - memoryCost: 65536 (64 MB) - memory usage
    // - timeCost: 3 - number of iterations
    // - parallelism: 4 - number of threads
    // - type: argon2id - most secure variant (resistant to both side-channel and GPU attacks)
    const hashed = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3, // 3 iterations
      parallelism: 4, // 4 threads
    });
    return hashed;
  } catch (error) {
    throw new Error("Password hashing failed");
  }
}

/**
 * Verify a password against a hash
 * @param {string} hash - Hashed password from database
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    // Invalid hash format or verification failed
    return false;
  }
}
