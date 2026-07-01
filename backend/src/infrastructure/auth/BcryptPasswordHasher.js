const bcrypt = require("bcryptjs");
const { PasswordHasher } = require("../../domain/ports/services");

class BcryptPasswordHasher extends PasswordHasher {
  constructor(rounds = 10) { super(); this.rounds = rounds; }
  async hash(plain) { return bcrypt.hash(String(plain), this.rounds); }
  async compare(plain, hash) { return bcrypt.compare(String(plain), String(hash || "")); }
}

module.exports = { BcryptPasswordHasher };
