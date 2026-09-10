export class CliError extends Error {
 code: string; exitCode: number;
 constructor(code: string, message: string, exitCode=2){super(message);this.code=code;this.exitCode=exitCode;}
}
export function statusExit(status: number,code=''){
 if(/BUDGET|CREDIT|APPROVAL/.test(code))return 6;
 return status===401||status===403?3:status===404?4:status===409?5:status===400||status===422?2:8;
}
