if (process.platform === "win32") {
  module.exports = require("./windows");
} else {
  module.exports = require("./macos");
}
