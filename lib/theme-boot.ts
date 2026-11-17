/** 첫 화면이 그려지기 전에 저장된 테마를 적용하는 스크립트(깜빡임 방지). components/device.ts 와 같은 키를 씁니다. */
export const THEME_BOOT = `try{if(localStorage.getItem("ego-theme")==="dark"){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#141111")}}catch(e){}`;
