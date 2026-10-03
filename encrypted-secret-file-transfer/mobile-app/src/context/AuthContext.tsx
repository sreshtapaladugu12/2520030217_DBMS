import React,{createContext,useContext,useEffect,useState} from 'react';
import * as SecureStore from 'expo-secure-store';
import {router} from 'expo-router';
import {api,setUnauthorizedHandler} from '../services/api';
type User={id:string;name:string;email:string;role:string};
type Auth={user:User|null;loading:boolean;login:(e:string,p:string)=>Promise<void>;register:(n:string,e:string,p:string)=>Promise<void>;logout:()=>Promise<void>};
const Context=createContext<Auth>({user:null,loading:true,login:async()=>{},register:async()=>{},logout:async()=>{}});
export const useAuth=()=>useContext(Context);
export function AuthProvider({children}:{children:React.ReactNode}) { const [user,setUser]=useState<User|null>(null); const [loading,setLoading]=useState(true);
 const logout=async()=>{await SecureStore.deleteItemAsync('efts_token');setUser(null);router.replace('/(auth)');};
 useEffect(()=>{setUnauthorizedHandler(()=>{void logout();});(async()=>{try{if(await SecureStore.getItemAsync('efts_token'))setUser((await api.me()).data.user);}catch{await SecureStore.deleteItemAsync('efts_token');}finally{setLoading(false);}})();},[]);
 const finish=async(r:any)=>{const u=r?.data?.user;if(typeof r?.data?.token!=='string'||typeof u?.id!=='string'||typeof u?.email!=='string'||typeof u?.name!=='string')throw new Error('The server returned an invalid authentication response.');await SecureStore.setItemAsync('efts_token',r.data.token);setUser(u);};
 return <Context.Provider value={{user,loading,login:async(e,p)=>finish(await api.login(e,p)),register:async(n,e,p)=>finish(await api.register(n,e,p)),logout}}>{children}</Context.Provider>;
}
