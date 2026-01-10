/**
 * Generator bezpiecznych haseł i walidacja siły hasła
 */

export function generateSecurePassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = uppercase + lowercase + numbers + symbols;

  let password = "";

  // Zapewnij co najmniej jeden znak z każdej kategorii
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Wypełnij resztę losowymi znakami
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Przetasuj znaki (Fisher-Yates shuffle)
  const passwordArray = password.split("");
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join("");
}

export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
  score: number; // 0-5
}

export function validatePasswordStrength(
  password: string
): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  // Długość
  if (password.length < 12) {
    errors.push("Hasło musi mieć co najmniej 12 znaków");
  } else if (password.length >= 12) {
    score += 1;
  }

  if (password.length >= 16) {
    score += 1;
  }

  // Wielka litera
  if (!/[A-Z]/.test(password)) {
    errors.push("Hasło musi zawierać wielką literę");
  } else {
    score += 1;
  }

  // Mała litera
  if (!/[a-z]/.test(password)) {
    errors.push("Hasło musi zawierać małą literę");
  } else {
    score += 1;
  }

  // Cyfra
  if (!/[0-9]/.test(password)) {
    errors.push("Hasło musi zawierać cyfrę");
  } else {
    score += 1;
  }

  // Znak specjalny
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push("Hasło musi zawierać znak specjalny");
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5),
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "Bardzo słabe";
    case 2:
      return "Słabe";
    case 3:
      return "Średnie";
    case 4:
      return "Silne";
    case 5:
      return "Bardzo silne";
    default:
      return "Nieznane";
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "text-red-600";
    case 2:
      return "text-orange-600";
    case 3:
      return "text-yellow-600";
    case 4:
      return "text-green-600";
    case 5:
      return "text-green-700";
    default:
      return "text-gray-600";
  }
}
