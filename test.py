#arr = [0b00000001, 0b00000010, 0b00000100, 0b00001000, 0b00010000, 0b00100000, 0b01000000]

arr = [0,
201,
9,
28,
72,
176,
160,
193,
131,
4,205
,41,92,184,
174,161,195,133
]
bit_pos = 0
current_code_length = 9
codes = []
while bit_pos // 8 < len(arr):
  b = arr[bit_pos // 8]
  while True:
    bit_pos_in_byte = bit_pos % 8
    code = 0
    code_part1 = (b >> bit_pos_in_byte) & ((1 << current_code_length) - 1)
    code |= code_part1
    if bit_pos_in_byte + current_code_length > 8 and bit_pos//8 + 1 < len(arr):
      next_b = arr[bit_pos//8 + 1]
      bits_left = current_code_length - (8 - bit_pos_in_byte)
      code_part2 = next_b & ((1 << bits_left) - 1)
      code |= code_part2 << (8 - bit_pos_in_byte)
    codes.append(code)
    bit_pos += current_code_length
    if bit_pos_in_byte + current_code_length > 8: break
  print(bit_pos, code)

print()

bit_pos = 0
while (bit_pos // 8) < len(arr):
  code = 0
  for i in range(current_code_length):
    if arr[bit_pos // 8] & (1 << (bit_pos % 8)):
      code |= 1 << i
    bit_pos += 1
  print(bit_pos % 8, code, bit_pos)
