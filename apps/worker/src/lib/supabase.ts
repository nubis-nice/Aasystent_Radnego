// TODO: Add Supabase client setup for worker
// This will be implemented after Supabase project creation

export const supabase = {
  // Placeholder - will be replaced with actual Supabase client
  auth: {
    admin: {
      async getUserById(userId: string) {
        // TODO: Implement actual user verification
        console.log(`[supabase] Getting user by ID: ${userId}`);
        return { data: { user: null }, error: null };
      },
    },
  },
};
