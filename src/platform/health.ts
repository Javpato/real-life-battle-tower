import { Capacitor, registerPlugin } from '@capacitor/core';

export type HealthAvailability = {available:boolean;healthConnect:boolean;stepCounter:boolean;reason?:string};
export type HealthReading = {source:'health-connect'|'step-counter';steps:number;startTime:string;endTime:string;bootId?:string};
export type ImportedHealth = {startTime:string;endTime:string;steps:number;sleepMinutes:number|null;activeCalories:number|null;weightKg:number|null;sources:string[]};
interface NativeHealthPlugin {
 availability():Promise<HealthAvailability>;
 requestHealthPermissions():Promise<{activityRecognition:boolean;healthConnect:boolean}>;
 readSteps(options:{startTime:string;endTime?:string;source?:'health-connect'|'step-counter'}):Promise<HealthReading>;
 importHealth(options:{startTime:string;endTime?:string}):Promise<ImportedHealth>;
}
const native=registerPlugin<NativeHealthPlugin>('EverstrideHealth');
export const healthPlatform = {
 async availability():Promise<HealthAvailability>{
  if(Capacitor.getPlatform()!=='android')return {available:false,healthConnect:false,stepCounter:false,reason:'Real step and health imports require the Android app and device permissions.'};
  try{return await native.availability();}catch{return {available:false,healthConnect:false,stepCounter:false,reason:'The native health plugin is not installed in this build.'};}
 },
 async requestPermissions(){if(Capacitor.getPlatform()!=='android')throw new Error('Health permissions are available only in the Android app.');return native.requestHealthPermissions();},
 async readSteps(options:Parameters<NativeHealthPlugin['readSteps']>[0]){if(Capacitor.getPlatform()!=='android')throw new Error('Web browsers cannot provide verified device steps.');return native.readSteps(options);},
 async importHealth(options:Parameters<NativeHealthPlugin['importHealth']>[0]){if(Capacitor.getPlatform()!=='android')throw new Error('Health import requires Android Health Connect.');return native.importHealth(options);}
};
