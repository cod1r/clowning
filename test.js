
let bit_pos_in_byte = 7
let idx = 0
let bytes = [0b10000000, 0b00000000, 0b00000011]
let currentCodeBitLength = 10
let byte = bytes[idx]
            let code = (byte >> bit_pos_in_byte) & ((1 << currentCodeBitLength) - 1)
            let lengthLeft = currentCodeBitLength - (8 - bit_pos_in_byte)
            while (lengthLeft > 0) { 
              // only time this while loop runs is if lengthLeft is positive which only occurs when reading across byte boundaries is needed
              ++idx
              const nextByte = bytes[idx]
              const part_of_code2 = nextByte & ((1 << lengthLeft) - 1)
              code |= part_of_code2 << (currentCodeBitLength - lengthLeft)
              lengthLeft -= 8
            }
console.log(code)
console.log((224).toString(2))
console.log((191).toString(2))
console.log((39).toString(2))
