const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function parsePngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 24) {
    throw new Error("Invalid PNG: file is too small");
  }

  for (let index = 0; index < PNG_SIGNATURE.byteLength; index += 1) {
    if (buffer[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Invalid PNG: signature mismatch");
    }
  }

  const firstChunkLength = buffer.readUInt32BE(8);
  const firstChunkType = buffer.toString("ascii", 12, 16);
  if (firstChunkType !== "IHDR" || firstChunkLength !== 13) {
    throw new Error("Invalid PNG: missing IHDR chunk");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new Error("Invalid PNG: dimensions must be positive");
  }

  return { width, height };
}

module.exports = {
  parsePngDimensions,
};
