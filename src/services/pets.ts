import { supabase, supabaseServer } from "@/lib/supabase";
import { getPetImageUrl } from "@/lib/utils";

export type PetType = "dog" | "cat";

export interface PetImage {
	petId: string;
	path: string;
}

export interface Pet {
	id: string;
	name: string;
	//image: string;      // URL pública (o storage URL firmada)
	age: string;
	breed: string;
	location: string;
	type: PetType;
	pet_images?: PetImage[];
}

const ERROR_CODE_ALREADY_EXISTS = "23505";

export const getPets = async (page = 1, perPage = 6) => {
	const from = (page - 1) * perPage;
	const to = from + perPage - 1;

	// Nota: { count: 'exact' } te da el total para paginar
	const { data, error, count } = await supabase
		.from("pets")
		.select(
			`
		*,
		pet_images (
			id,
			path
		)
	`,
			{ count: "exact" },
		)
		.order("created_at", { ascending: false })
		.range(from, to);

	if (error) throw error;

	const petsWithUrls = data.map((pet) => ({
		...pet,
		pet_images: pet.pet_images.map((img) => ({
			...img,
			url: getPetImageUrl(img.path),
		})),
	}));

	return {
		pets: (petsWithUrls ?? []) as Pet[],
		total: count ?? 0,
		//pets: (allPets ?? []) as Pet[],
		//total: petcount ?? 0,
	};
};

export const publishPetForAdoption = async (
	name: string,
	slug: string,
	species: string,
	breed: string,
	gender: string,
	age: string,
	size: string,
	color: string,
	location: string,
	bio: string,
	org_id: string,
) => {
	const { data, error } = await supabase
		.from("pets")
		.insert({
			name,
			slug,
			species,
			breed,
			gender,
			age,
			size,
			color,
			location,
			bio,
			org_id,
		})
		.select("id")
		.single();

	// if (error?.code === ERROR_CODE_ALREADY_EXISTS) {
	//   return {
	//     duplicated: true,
	//     success: true,
	//     error: null
	//   }
	// }

	if (error) {
		console.error(error);
		return {
			success: false,
			error: "Error al guardar el adoptable. Intente de nuevo.",
			petId: null,
		};
	}

	return {
		success: true,
		error: null,
		petId: data.id, // Devolver el ID
	};
};

export const getPetsByOrg = async (org_id: string) => {
	const { data, error } = await supabase
		.from("pets")
		.select(
			`
			*,
			pet_images!inner (
				id,
				path
			)
		`,
		)
		.eq("org_id", org_id)
		.order("created_at", { ascending: false })
		.limit(1, { foreignTable: "pet_images" }); // new for just 1 image

	if (error) {
		console.error(error); // pino logger

		return {
			pets: null,
			success: false,
			error: "Error al obtener el adoptable",
		};
	}

	// Transformar para agregar URLs públicas
	const petsWithUrls = data.map((pet) => ({
		...pet,
		pet_images: pet.pet_images.map((img) => ({
			...img,
			url: getPetImageUrl(img.path),
		})),
	}));

	return {
		pets: petsWithUrls,
		success: true,
		error: null,
	};
};

export const uploadPetImages = async (petId: number, images: File[]) => {
	try {
		const uploadPromises = images.map(async (file, index) => {
			// Generar nombre único
			const fileExt = file.name.split(".").pop();
			const fileName = `${petId}/${Date.now()}-${index}.${fileExt}`;

			// Subir a Storage
			const { error: uploadError } = await supabaseServer.storage
				.from("pets")
				.upload(fileName, file, {
					cacheControl: "3600",
					upsert: false,
				});

			if (uploadError) {
				throw uploadError;
			}

			// Guardar en pet_images
			const { error: dbError } = await supabaseServer
				.from("pet_images")
				.insert({
					pet_id: petId,
					path: fileName,
					//position: index,
				});

			if (dbError) {
				// Limpiar archivo si falla la inserción
				await supabaseServer.storage.from("pets").remove([fileName]);
				throw dbError;
			}

			return fileName;
		});

		await Promise.all(uploadPromises);

		return {
			success: true,
			error: null,
		};
	} catch (error) {
		console.error("Error uploading images:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error subiendo imágenes",
		};
	}
};

export const getPetBySlug = async (slug: string) => {
	const { data, error } = await supabase
		.from("pets")
		.select(
			`
			*,
			pet_images (
				id,
				path
			)
		`,
		)
		.eq("slug", slug)
		.single();

	if (error) {
		console.error(error); // pino logger
		return {
			pet: null,
			error: true,
		};
	}

	// Transformar para agregar URLs públicas
	const petWithUrls = {
		...data,
		pet_images: data.pet_images.map((img) => ({
			...img,
			url: getPetImageUrl(img.path),
		})),
	};

	return {
		pet: petWithUrls,
		error: null,
	};
};

export const getRecentPets = async (limit: number) => {
	console.log(limit);
	const { data, error } = await supabase
		.from("pets")
		.select(
			`
			*,
			pet_images!inner (
				id,
				path
			)
		`,
		)
		.order("created_at", { ascending: false })
		.limit(limit, { foreignTable: "pet_images" });

	if (error) {
		console.error(error); // pino logger

		return {
			pets: null,
			success: false,
			error: "Error al obtener el adoptable",
		};
	}

	// Transformar para agregar URLs públicas
	const petsWithUrls = data.map((pet) => ({
		...pet,
		pet_images: pet.pet_images.map((img) => ({
			...img,
			url: getPetImageUrl(img.path),
		})),
	}));

	return {
		pets: petsWithUrls,
		success: true,
		error: null,
	};
};
