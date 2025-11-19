
import { supabase } from "@/lib/supabase";

export interface Post {
    id: string;
    title: string;
    slug: string;
    image_path: string;
    excerpt: string;
    content: string;
    author: string;
    created_at: string;
    category: string;
}

export const getPosts = async (page = 1, perPage = 6) => {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
        .from("posts")
        .select('*', { count: "exact" },)
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) throw error;

    return {
        posts: (data ?? []) as Post[],
        total: count ?? 0,
    };
};

export const getPostBySlug = async (slug: string) => {
    const { data, error } = await supabase
        .from("posts")
        .select('*')
        .eq("slug", slug)
        .single();

    if (error) {
        console.error(error);
        return {
            post: null,
            error: true,
        };
    }

    return {
        post: data,
        error: null,
    };
};
