export function generateAdminPassword(): string {
  const groups = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()_+-=?',
  ]
  const alphabet = groups.join('')
  const randomIndex = (length: number) => {
    const bytes = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / length) * length
    do {
      crypto.getRandomValues(bytes)
    } while (bytes[0] >= limit)
    return bytes[0] % length
  }
  const characters = groups.map((group) => group[randomIndex(group.length)])
  while (characters.length < 16) characters.push(alphabet[randomIndex(alphabet.length)])
  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1)
    ;[characters[index], characters[other]] = [characters[other], characters[index]]
  }
  return characters.join('')
}
