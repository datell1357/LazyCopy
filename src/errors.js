class LazyCopyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LazyCopyError";
    this.code = code;
  }
}

module.exports = {
  LazyCopyError,
};
