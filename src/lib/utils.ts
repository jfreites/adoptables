import { supabase } from "./supabase";
import type { Pet, PetAdoptionRule } from "./types";

export async function fetchPetAndRule(
	petSlug: string,
): Promise<{ pet: Pet; rule?: PetAdoptionRule }> {
	const { data, error } = await supabase
		.from("pets")
		.select("id, slug, name, species, rules:pet_adoption_rules(*)")
		//.eq('slug', petSlug)
		.eq("id", 1)
		.single();

	console.log(data, error);

	if (error || !data) throw new Error("Pet not found");

	const pet: Pet = {
		id: data.id,
		slug: data.slug,
		name: data.name,
		species: data.species,
	};
	const rule = (data as any).rules as PetAdoptionRule | undefined;

	return { pet, rule };
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
