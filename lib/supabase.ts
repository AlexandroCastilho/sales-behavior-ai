import { createClient } from "@supabase/supabase-js";

function assertEnv(value: string | undefined, name: string): string {
	if (!value) {
		throw new Error(`${name} nao definido no ambiente.`);
	}
	return value;
}

export function createSupabaseServerClient() {
	const url = assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
	const serviceRoleKey = assertEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");

	return createClient(url, serviceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}
