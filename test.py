arr = [0b00000001, 0b00000010, 0b00000100]
bit_pos = 0
current_code_length = 9
codes = []
for idx in range(len(arr)):
  b = arr[idx]
  while bit_pos < 8:
    code = 0
    code_part1 = (b >> bit_pos) & ((1 << current_code_length) - 1)
    code |= code_part1
    if bit_pos + current_code_length > 8 and idx + 1 < len(arr):
      next_b = arr[idx + 1]
      bits_left = current_code_length - (8 - bit_pos)
      code_part2 = next_b & ((1 << bits_left) - 1)
      code |= code_part2 << (8 - bit_pos)
    codes.append(code)
    bit_pos += current_code_length
  bit_pos %= 8

print(codes)
