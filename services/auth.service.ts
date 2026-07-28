import { supabase } from '../lib/supabase';

export const authService = {
    async signUp(email: string, password: string, fullName?: string){
        const {data,error}= await supabase.auth.signUp({
            email,password,options:{
                data:{full_name: fullName}
            }
        });
        if (error) throw error;
        return data;
    },
    async signIn(email: string, password: string){
        const {data,error}= await supabase.auth.signInWithPassword({
            email,password,
        });
        if (error) throw error;
        return data;
    },
    async signOut(){
        const {error}=await supabase.auth.signOut();
        if (error) throw error;
    },
    async getCurrentSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },
    async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    },
    async getProfile(userId:string){
        const {data,error} =await supabase
          .from('profiles')
          .select('*')
          .eq('id',userId)
          .single()
        if(error) throw error
        return data;
    },
    async updateProfile(userId: string,updates: Partial<{
        full_name:string;
        phone:string;
    }>){
        const {data,error} =await supabase
          .from('profiles')
          .update(updates)
          .eq('id',userId)
          .select()
          .single();
        if (error) throw error;
        return data;
    },
}