import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const configuredUrl = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000') : '');
if (!__DEV__ && !configuredUrl.startsWith('https://')) throw new Error('Set EXPO_PUBLIC_API_URL to the HTTPS API Gateway URL before making a production build.');
export const API_URL = configuredUrl.replace(/\/$/, '');
let unauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { unauthorized = fn; };
export const client = axios.create({ baseURL: `${API_URL}/api`, timeout: 60000 });
client.interceptors.request.use(async config => { const token = await SecureStore.getItemAsync('efts_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
client.interceptors.response.use(r => r, async error => { if (error.response?.status === 401) unauthorized();let message=error.response?.data?.error;if(!message&&error.response?.data instanceof ArrayBuffer){try{const bytes=new Uint8Array(error.response.data);let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));message=JSON.parse(text).error}catch{}}throw new Error(message || (error.code === 'ECONNABORTED' ? 'The request timed out.' : 'Cannot reach the server. Check the API URL and network connection.')); });
const q = (obj: Record<string,string|number|undefined>) => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined));
export const api = {
 login:(email:string,password:string)=>client.post('/auth/login',{email,password}), register:(name:string,email:string,password:string)=>client.post('/auth/register',{name,email,password}), me:()=>client.get('/auth/me'), overview:()=>client.get('/overview'),
 files:(scope='all')=>client.get('/files',{params:{scope}}), file:(id:string)=>client.get(`/files/${id}`), removeFile:(id:string)=>client.delete(`/files/${id}`),
 permissions:(id:string)=>client.get(`/permissions/${id}`), share:(fileId:string,email:string,level='download')=>client.post('/permissions',{fileId,email,level}), revoke:(id:string)=>client.delete(`/permissions/${id}`), logs:(params={})=>client.get('/logs',{params:q(params)}),
 adminStats:()=>client.get('/admin/stats'), adminUsers:()=>client.get('/admin/users'), adminLogs:(params={})=>client.get('/admin/logs',{params:q(params)}), patchUser:(id:string,body:object)=>client.patch(`/admin/users/${id}`,body), health:()=>client.get('/service-status'),
 upload: async (uri:string,name:string,type:string,onProgress:(n:number)=>void)=>{ const data=new FormData(); data.append('file',{uri,name,type} as any); return client.post('/files/upload',data,{headers:{'Content-Type':'multipart/form-data'},onUploadProgress:e=>{if(e.total)onProgress(Math.round(e.loaded/e.total*100));}}); },
 download:(id:string,onProgress?:(n:number)=>void)=>client.get(`/files/${id}/download`,{responseType:'arraybuffer',onDownloadProgress:e=>{if(e.total&&onProgress)onProgress(Math.round(e.loaded/e.total*100));}}),
};
