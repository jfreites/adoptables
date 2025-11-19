import { supabase } from "./supabase";
import type { Organization, Pet, PetAdoptionRule } from "./types";

export async function fetchPetAndRules(
	petSlug: string,
): Promise<{ pet?: Pet; rule?: PetAdoptionRule; organization?: Organization }> {
	const { data, error } = await supabase
		.from("pets")
		.select(
			"id, slug, name, species, rules:pet_adoption_rules(*), organizations(id, slug, name, type)",
		)
		.eq("slug", petSlug)
		.single();

	// Pet not found or with invalid data, return empty results
	if (error || !data) return { pet: null, rule: null, organization: null };

	const pet: Pet = {
		id: data.id,
		slug: data.slug,
		name: data.name,
		species: data.species,
	};

	const rule = (data as any).rules as PetAdoptionRule | undefined;

	const organization: Organization = {
		id: data.organizations.id,
		slug: data.organizations.slug,
		name: data.organizations.name,
		type: data.organizations.type,
	};

	return { pet, rule, organization };
}

export async function uploadDocuments(
	applicationId: string,
	files: File[],
	declaredTypes: Record<string, boolean> = {},
) {
	const bucket = "applications";
	const decl = Object.keys(declaredTypes).filter((k) => declaredTypes[k]);

	for (const file of files) {
		const ext = file.name.split(".").pop() || "bin";
		const path = `${applicationId}/${crypto.randomUUID()}.${ext}`;
		const { error } = await supabase.storage.from(bucket).upload(path, file, {
			contentType: file.type,
			upsert: false,
		});
		if (error) throw error;

		// opcional: registra metadata en tabla application_documents
		await supabase.from("application_documents").insert({
			application_id: applicationId,
			path,
			declared_types: decl,
			mime: file.type,
			size: file.size,
		});
	}
}

export function slugifyBase(input: string): string {
	// Normaliza, quita acentos y caracteres no válidos
	return input
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "") // diacríticos
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-") // separadores
		.replace(/^-+|-+$/g, "") // bordes
		.slice(0, 120); // límite opcional
}

export function randomBase62(n = 8): string {
	const alphabet =
		"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const bytes = new Uint8Array(n);
	crypto.getRandomValues(bytes);
	let out = "";
	for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
	return out;
}

export function makeSlug(
	name: string,
	opts?: { randomLen?: number; withDate?: boolean },
) {
	const base = slugifyBase(name);
	const parts = [base];

	if (opts?.withDate) {
		// Útil si publicas muchos con el mismo título por día; mantiene algo de orden.
		const d = new Date();
		const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
		parts.push(ymd);
	}

	parts.push(randomBase62(opts?.randomLen ?? 8));
	return parts.filter(Boolean).join("-");
}

export const getPetImageUrl = (path: string): string => {
	const { data } = supabase.storage.from("pets").getPublicUrl(path);

	return data.publicUrl;
};

export enum PetSizeDbValue {
	SMALL = "small",
	MEDIUM = "medium",
	LARGE = "large",
}

export type PetSizeHumanReadable = "Pequeño" | "Mediano" | "Grande";

const PetSizeMap: Record<PetSizeDbValue, PetSizeHumanReadable> = {
	[PetSizeDbValue.SMALL]: "Pequeño",
	[PetSizeDbValue.MEDIUM]: "Mediano",
	[PetSizeDbValue.LARGE]: "Grande",
};

/**
 * Translates a database Pet Species value to a human-readable string.
 * @param dbValue The status code from the database.
 * @returns The human-readable string, or 'Unknown' if the value is not found.
 */
export function translatePetSpecies(
	dbValue: PetSizeDbValue,
): PetSizeHumanReadable | "Desconocido" {
	// Use the lookup map to get the translated value
	const humanReadableValue = PetSizeMap[dbValue];

	// Return the value, or a default 'Unknown' for safety
	return humanReadableValue || "Desconocido";
}

export function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
