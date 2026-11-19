// @flow
type GCE = {
  disposalMethod: number,
  userInputFlag: number,
  transparentColorFlag: number,
  transparentColorIndex: number,
  delayTime: number,
};
type GIF = {
  buffer: void | Uint8Array<ArrayBuffer>,
  screenWidth: void | number,
  screenHeight: void | number,
  globalColorTableExists: void | number,
  colorResolution: void | number,
  sortFlag: void | number,
  backgroundColorIndex: void | number,
  pixelAspectRatio: void | number,
  globalColorTable: void | [number, number],
  dataBlocks: Array<
    | {
        type: "graphic block",
        gce: GCE | null,
        imageData: Array<number>,
        imageDescriptor: {
          imageLeftPos: number,
          imageTopPos: number,
          imageWidth: number,
          imageHeight: number,
          interlaceFlag: number,
          sortFlag: number,
        },
        imageData: Array<number>,
        localColorTableSegment: [number, number] | null,
      }
    | {
        type: "application",
        applicationId: Uint8Array<ArrayBuffer>,
        applicationAuthCode: Uint8Array<ArrayBuffer>,
        applicationDataSegments: Array<[number, number]>,
      }
    | { type: "comment", commentDataBlockSegments: Array<[number, number]> }
    | {
        type: "plain text",
        gce: GCE | null,
        textGridLeftPos: number,
        textGridTopPos: number,
        textGridWidth: number,
        textGridHeight: number,
        charCellWidth: number,
        charCellHeight: number,
        textForegroundColorIdx: number,
        textForegroundColorIdx: number,
        plainTextDataSegments: Array<[number, number]>,
      },
  >,
};
export function parseGIF(
  arrayBuffer: ArrayBuffer,
  log: boolean = false,
): GIF | null {
  const gif: GIF = {
    buffer: undefined,
    screenWidth: undefined,
    screenHeight: undefined,
    globalColorTableExists: undefined,
    colorResolution: undefined,
    sortFlag: undefined,
    backgroundColorIndex: undefined,
    pixelAspectRatio: undefined,
    globalColorTable: undefined,
    dataBlocks: [],
  };
  /*
  https://giflib.sourceforge.net/gifstandard/GIF89a.html
  header: GIF + VERSION
  logical screen descriptor: width, height, flags indicating info such as global color table presence
  optional global color table
  image descriptor: contains image position and size info, could be optionally preceded by a graphic control extension block
  local color table: optional
  image data
  */
  const uint8 = new Uint8Array(arrayBuffer);
  gif.buffer = uint8;
  const isGIF =
    uint8
      .slice(0, 3)
      .reduce((acc, elem) => acc + String.fromCharCode(elem), "") === "GIF";
  if (!isGIF) return null;
  let gif_idx = 6; // skipping first six bytes which are GIF (3 bytes) and the version (3 bytes)
  const screenWidth = uint8[gif_idx] | (uint8[gif_idx + 1] << 8);
  const screenHeight = uint8[gif_idx + 2] | (uint8[gif_idx + 3] << 8);
  const packedFields = uint8[gif_idx + 4];
  const globalColorTableExists = packedFields >> 7;
  gif.screenWidth = screenWidth;
  gif.screenHeight = screenHeight;
  gif.globalColorTableExists = globalColorTableExists;
  const colorResolution = (packedFields >> 4) & 0b111;
  gif.colorResolution = colorResolution;
  const sortFlag = (packedFields >> 3) & 0b1;
  gif.sortFlag = sortFlag;
  const globalColorTableSize = packedFields & 0b111; // size is calculated by 2 ^ (globalColorTableSize + 1)
  const backgroundColorIndex = uint8[gif_idx + 5];
  gif.backgroundColorIndex = backgroundColorIndex;
  const pixelAspectRatio = uint8[gif_idx + 6]; // used in the formula (pixelAspectRatio + 15) / 64
  gif.pixelAspectRatio = pixelAspectRatio;
  const actualGlobalColorTableSize = 3 * 2 ** (globalColorTableSize + 1);
  if (log) console.log("gct size", 2 ** (globalColorTableSize + 1));
  gif_idx += 7;
  if (globalColorTableExists) {
    const globalColorBytes = uint8.slice(
      gif_idx,
      gif_idx + actualGlobalColorTableSize,
    );
    gif.globalColorTable = [gif_idx, actualGlobalColorTableSize];
    gif_idx += actualGlobalColorTableSize;
  }
  let imageDescriptorCounter = 0;
  let endOfInfoCounter = 0;
  let gce = null;
  const startOfGifParseTime = performance.now();
  while (gif_idx < uint8.length) {
    if (uint8[gif_idx] === 0x21) {
      gif_idx += 1;
      switch (uint8[gif_idx] as number) {
        case 0xf9: {
          // graphic control extension
          if (log) console.log("gce");
          const size = 4; // fixed number
          const packedFields = uint8[gif_idx + 2];
          const disposalMethod = (packedFields >> 2) & 0b111;
          const userInputFlag = (packedFields >> 1) & 0b1;
          const transparentColorFlag = packedFields & 0b1;
          const delayTime = uint8[gif_idx + 3] | (uint8[gif_idx + 4] << 8); // number of 1/100 seconds
          const transparentColorIndex = uint8[gif_idx + 5];
          gce = {
            disposalMethod,
            userInputFlag,
            transparentColorFlag,
            delayTime,
            transparentColorIndex,
          };
          if (uint8[gif_idx + 6] !== 0)
            throw Error("should be block terminator");
          gif_idx += 7;
          break;
        }
        case 0xff: {
          // application extension
          gce = null;
          if (log) console.log("application");
          const blockSize = 11; // fixed size
          const applicationId = uint8.slice(gif_idx + 2, gif_idx + 2 + 8);
          if (log)
            console.log(
              applicationId.reduce(
                (acc, byte) => acc + String.fromCharCode(byte),
                "",
              ),
            );
          const applicationAuthCode = uint8.slice(
            gif_idx + 2 + 8,
            gif_idx + 2 + 8 + 3,
          );
          gif_idx += 2 + 8 + 3;
          const applicationDataSegments: Array<[number, number]> = [];
          while (uint8[gif_idx] !== 0) {
            const dataSubBlockSize = uint8[gif_idx];
            applicationDataSegments.push([gif_idx + 1, dataSubBlockSize]);
            gif_idx += dataSubBlockSize + 1;
          }
          gif.dataBlocks.push({
            type: "application",
            applicationId,
            applicationAuthCode,
            applicationDataSegments,
          });
          gif_idx += 1;
          break;
        }
        case 0xfe: {
          // comment extension
          gce = null;
          if (log) console.log("comment");
          gif_idx += 1;
          const commentDataBlockSegments: Array<[number, number]> = [];
          while (uint8[gif_idx] !== 0) {
            const dataSubBlockSize = uint8[gif_idx];
            commentDataBlockSegments.push([gif_idx + 1, dataSubBlockSize]);
            gif_idx += dataSubBlockSize + 1;
          }
          gif.dataBlocks.push({ type: "comment", commentDataBlockSegments });
          gif_idx += 1;
          break;
        }
        case 0x01: {
          // plain text extension
          if (log) console.log("plain text");
          const blockSize = 12; // fixed size
          const textGridLeftPos =
            uint8[gif_idx + 1] | (uint8[gif_idx + 2] << 8);
          const textGridTopPos = uint8[gif_idx + 3] | (uint8[gif_idx + 4] << 8);
          const textGridWidth = uint8[gif_idx + 5] | (uint8[gif_idx + 6] << 8);
          const textGridHeight = uint8[gif_idx + 7] | (uint8[gif_idx + 8] << 8);
          const charCellWidth = uint8[gif_idx + 9];
          const charCellHeight = uint8[gif_idx + 10];
          const textForegroundColorIdx = uint8[gif_idx + 11];
          const textBackgroundColorIdx = uint8[gif_idx + 12];
          gif_idx += 13;
          const plainTextDataSegments: Array<[number, number]> = [];
          while (uint8[gif_idx] !== 0) {
            const dataSubBlockSize = uint8[gif_idx];
            plainTextDataSegments.push([gif_idx + 1, dataSubBlockSize]);
            gif_idx += 1 + dataSubBlockSize;
          }
          gif.dataBlocks.push({
            type: "plain text",
            gce,
            textGridLeftPos,
            textGridTopPos,
            textGridWidth,
            textGridHeight,
            charCellWidth,
            charCellHeight,
            textForegroundColorIdx,
            textForegroundColorIdx,
            plainTextDataSegments,
          });
          gif_idx += 1;
          break;
        }
        default: {
          throw Error(`ok what the fuck is this ${uint8[gif_idx + 1]}`);
        }
      }
    } else if (uint8[gif_idx] === 0x3b) {
      // trailer block
      break;
    } else if (uint8[gif_idx] === 0x2c) {
      if (log) console.log("image descriptor");
      imageDescriptorCounter++;
      const imageLeftPos = uint8[gif_idx + 1] | (uint8[gif_idx + 2] << 8);
      const imageTopPos = uint8[gif_idx + 3] | (uint8[gif_idx + 4] << 8);
      const imageWidth = uint8[gif_idx + 5] | (uint8[gif_idx + 6] << 8);
      const imageHeight = uint8[gif_idx + 7] | (uint8[gif_idx + 8] << 8);
      const packedFields = uint8[gif_idx + 9];
      const localColorTableExists = (packedFields >> 7) & 0b1;
      const interlaceFlag = (packedFields >> 6) & 0b1;
      const sortFlag = (packedFields >> 5) & 0b1;
      const reserved = (packedFields >> 3) & 0b11;
      const localColorTableSize = packedFields & 0b111;
      gif_idx += 10;
      let localColorTableSegment = null;
      const actualLocalColorTableSize = 3 * 2 ** (localColorTableSize + 1);
      if (localColorTableExists) {
        localColorTableSegment = [gif_idx, actualLocalColorTableSize];
        gif_idx += actualLocalColorTableSize;
      }
      const imageDescriptor = {
        imageLeftPos,
        imageTopPos,
        imageWidth,
        imageHeight,
        interlaceFlag,
        sortFlag,
      };
      const lzwMinCodeSize = uint8[gif_idx]; // gif spec says code size starts at min code size + 1 bits, up to 12 bits
      if (log) console.log(lzwMinCodeSize, gif_idx, "idx of image data");
      gif_idx += 1;
      const clearCode = 2 ** lzwMinCodeSize;
      const endOfInfo = clearCode + 1;
      const bytes = [];
      while (gif_idx < uint8.length) {
        const dataSubBlockSize = uint8[gif_idx];
        if (dataSubBlockSize === 0) break;
        for (let i = gif_idx + 1; i < gif_idx + 1 + dataSubBlockSize; ++i)
          bytes.push(uint8[i]);
        gif_idx += 1 + dataSubBlockSize;
      }
      let bit_pos = 0;
      let currentCodeBitLength = lzwMinCodeSize + 1;
      const table: Array<Array<number> | null> = new Array(258);
      let prev: number | null = null;
      const resetTable = () => {
        prev = null;
        table.length = 0;
        for (let code = 0; code < clearCode; ++code) {
          table[code] = [code];
        }
        table[clearCode] = []; // clearCode index
        table[endOfInfo] = null; // endOfInfo index
        currentCodeBitLength = lzwMinCodeSize + 1;
      };
      const imageData: Array<number> = [];
      const start = performance.now();
      outer: while (Math.floor(bit_pos / 8) < bytes.length) {
        let idx = Math.floor(bit_pos / 8);
        let bit_pos_in_byte = bit_pos % 8;
        const byte = bytes[idx];
        let code =
          (byte >> bit_pos_in_byte) & ((1 << currentCodeBitLength) - 1);
        let lengthLeft = currentCodeBitLength - (8 - bit_pos_in_byte);
        while (lengthLeft > 0) {
          // only time this while loop runs is if lengthLeft is positive which only occurs when reading across byte boundaries is needed
          ++idx;
          const nextByte = bytes[idx];
          const part_of_code2 = nextByte & ((1 << lengthLeft) - 1);
          code |= part_of_code2 << (currentCodeBitLength - lengthLeft);
          lengthLeft -= 8;
        }
        bit_pos += currentCodeBitLength;

        switch (code) {
          case endOfInfo: {
            endOfInfoCounter++;
            break outer;
          }
          case clearCode: {
            resetTable();
            continue;
          }
        }

        if (prev !== null) {
          const prevValue = table[prev];
          if (table[code] === undefined) {
            // sometimes the encoders will output a code that is of the maximum table size
            if (code !== table.length) {
              console.error(
                "only codes that would not be in the table that are also valid are ones that equal the table length; anything else is invalid data",
              );
              debugger;
            }
            if (prevValue === null) throw Error("table[prev] is null");
            table.push(prevValue.concat(prevValue[0]));
          } else {
            if (prevValue === null) throw Error("table[prev] is null");
            table.push(prevValue.concat(prevValue[0]));
          }
          if (
            table.length === 2 ** currentCodeBitLength &&
            currentCodeBitLength < 12
          ) {
            ++currentCodeBitLength;
          }
        }
        imageData.push.apply(imageData, table[code]);
        prev = code;
      }
      gif.dataBlocks.push({
        type: "graphic block",
        gce,
        imageDescriptor,
        localColorTableSegment,
        imageData,
      });
      if (log)
        console.log(
          performance.now() - start,
          "time taken to decode image lzw data in ms",
        );
      if (uint8[gif_idx] !== 0)
        throw Error("this should've been the data sub block terminator");
      gif_idx += 1;
    } else {
      console.log(uint8[gif_idx], gif_idx, uint8.length);
      throw Error("UNHANDLED");
    }
  }
  if (log)
    console.log(
      "time to parse entire gif in ms",
      performance.now() - startOfGifParseTime,
      imageDescriptorCounter,
    );
  console.assert(imageDescriptorCounter === endOfInfoCounter);
  return gif;
}
