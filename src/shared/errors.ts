export class UserError extends Error {}

// Raw library/HTTP errors can contain request headers or a token. Never forward them.
export function publicError(error: unknown): string {
  if (error instanceof UserError) return error.message;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "ENOSPC")
      return "Le disque est plein. Libérez de l’espace puis réessayez.";
    if (error.code === "ENOENT")
      return "Le fichier est introuvable. Réimportez le son si nécessaire.";
    if (error.code === "EACCES" || error.code === "EPERM")
      return "Accès au fichier refusé. Vérifiez les permissions du dossier.";
  }
  return "L’opération a échoué. Vérifiez les réglages puis réessayez.";
}
