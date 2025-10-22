import { supabase } from "@/lib/supabase"

export type PetType = 'dog' | 'cat';

// delete later we have a pet full schema in supabase
import type { ImageMetadata } from 'astro';
import petDog1 from "@/assets/pet-dog-1.jpg";
import petCat1 from "@/assets/pet-cat-1.jpg";
import petDog2 from "@/assets/pet-dog-2.jpg";
import petCat2 from "@/assets/pet-cat-2.jpg";
// end delete

export interface Pet {
  id: string;
  name: string;
  image: ImageMetadata;
  //image: string;      // URL pública (o storage URL firmada)
  age: string;
  breed: string;
  location: string;
  type: PetType;
}

const ERROR_CODE_ALREADY_EXISTS = "23505"

export const getPets = async (page = 1, perPage = 6) => {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Nota: { count: 'exact' } te da el total para paginar
  // const { data, error, count } = await supabase
  //   .from('pets')
  //   .select('*', { count: 'exact' })
  //   .order('created_at', { ascending: false })
  //   .range(from, to);

  // if (error) throw error;


  // Just for testing pagination
  let allPets = []
  let petcount = 8;
  if (page == 1) {
    allPets = [
      { id: '1', name: 'Buddy', image: petDog1, age: '2 years old', breed: 'Golden Retriever', location: 'San Francisco, CA', type: 'dog' as const },
      { id: '2', name: 'Luna', image: petCat1, age: '1 year old', breed: 'Orange Tabby', location: 'Los Angeles, CA', type: 'cat' as const },
      { id: '3', name: 'Max', image: petDog2, age: '3 years old', breed: 'Beagle', location: 'Seattle, WA', type: 'dog' as const },
      { id: '4', name: 'Whiskers', image: petCat2, age: '2 years old', breed: 'Persian', location: 'Portland, OR', type: 'cat' as const },
      { id: '5', name: 'Charlie', image: petDog1, age: '4 years old', breed: 'Golden Retriever', location: 'Austin, TX', type: 'dog' as const },
      { id: '6', name: 'Mittens', image: petCat1, age: '3 years old', breed: 'Tabby Mix', location: 'Denver, CO', type: 'cat' as const },
    ];
  } else {
    allPets = [
      { id: '7', name: 'Rocky', image: petDog2, age: '5 years old', breed: 'Beagle Mix', location: 'Boston, MA', type: 'dog' as const },
      { id: '8', name: 'Snowball', image: petCat2, age: '1 year old', breed: 'Persian Mix', location: 'Miami, FL', type: 'cat' as const },
    ];
  }

  return {
    //pets: (data ?? []) as Pet[],
    // total: count ?? 0,
    pets: (allPets ?? []) as Pet[],
    total: petcount ?? 0,
  };
}

export const publishPetForAdoption = async (name: string, bio: string, species: string) => {
  const { error } = await supabase.from('pets').insert({ name, species, bio })

  // if (error?.code === ERROR_CODE_ALREADY_EXISTS) {
  //   return {
  //     duplicated: true,
  //     success: true,
  //     error: null
  //   }
  // }

  if (error) {
    console.error(error) // pino logger

    return {
      success: false,
      error: "Error al guardar el adoptable. Intente de nuevo."
    }
  }

  return {
    success: true,
    error: null
  }
}

export const listAvailablePets = async (filter: string[], total: number) => {
  const { data, error } = await supabase.from('pets').select('*')

  if (error) {
    console.error(error) // pino logger

    return {
      data: [],
      pagination: {},
      success: false,
      error: "Error al guardar el email en la newsletter"
    }
  }

  console.log(data)

  let listing = []

  if (total == 4) {
    listing = [
      {id: 1, name: 'Pixie', age: 12, bio: 'Lindo gato bicolor, jugueton y ronroneador'},
      {id: 2, name: 'Marlon', age: 8, bio: 'Gato talla grande y de pelo largo, muy sociable'},
      {id: 3, name: 'Justin', age: 8, bio: 'Hermosa gata de pelo largo y color cafe muy sociable'},
      {id: 6, name: 'Blanco', age: 3, bio: 'Jugueton y sociable con gatos y perros'}
    ]
  } else {
    listing = data
  }

  return {
    data: listing,
    pagination: {},
    success: true,
    error: null
  }
}
