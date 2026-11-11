export function expectedDocument(did, publicKey) {
  const keyId = `${did}#identity-key`;
  return { "@context": ["https://www.w3.org/ns/did/v1"], id: did, verificationMethod: [{ id: keyId, type: "EcdsaSecp256k1VerificationKey2019", controller: did, publicKeyHex: publicKey }], authentication: [keyId] };
}

export function validateRegistrationFiles(profile, document, did, publicKey) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile) || typeof profile.name !== "string" || !profile.name.trim() || typeof profile.description !== "string" || !profile.description.trim()) throw Error("PROFILE_REVIEW_REQUIRED");
  const keyId = `${did}#identity-key`;
  if (!document || document.id !== did || !Array.isArray(document.verificationMethod) || !document.verificationMethod.some(item => item.id === keyId && item.controller === did && item.publicKeyHex === publicKey) || !Array.isArray(document.authentication) || !document.authentication.includes(keyId)) throw Error("DID_DOCUMENT_MISMATCH");
}
