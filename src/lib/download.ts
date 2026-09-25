export function downloadAccountKey(key: string, login: string) {
  const blob = new Blob(
    [
      `Viking Chat — ключ аккаунта @${login}\n\n${key}\n\nХраните в безопасном месте. Он нужен для входа на новом устройстве и расшифровывает облачную переписку.`,
    ],
    { type: 'text/plain;charset=utf-8' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `viking-key-${login}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}
