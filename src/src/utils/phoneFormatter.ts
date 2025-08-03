export function formatPhoneNumber(value: string): string {
  let cleaned = value.replace(/\D/g, '');
  if (cleaned.length > 0 && !['7', '8'].includes(cleaned[0])) {
    cleaned = '7' + cleaned;
  }
  cleaned = cleaned.substring(0, 11);

  const match = cleaned.match(/^(\d)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!match) return '';

  return `+${match[1]}${match[2] ? ` (${match[2]}` : ''}${match[3] ? `) ${match[3]}` : ''}${match[4] ? `-${match[4]}` : ''}${match[5] ? `-${match[5]}` : ''}`;
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.length > 0 && cleaned[0] === '7') {
    cleaned = '8' + cleaned.substring(1);
  }

  return cleaned.substring(0, 11);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 11 && (cleaned[0] === '7' || cleaned[0] === '8');
}
