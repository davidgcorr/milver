// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {captureTab,videoMimeType} from './capture';
afterEach(()=>vi.unstubAllGlobals());
it('selects a supported video container rather than assuming MP4 encoding exists',()=>{
  expect(videoMimeType(type=>type==='video/webm;codecs=vp8')).toBe('video/webm;codecs=vp8');
  expect(videoMimeType(()=>true)).toBe('video/mp4;codecs=avc1.42E01E');
  expect(videoMimeType(()=>false)).toBeUndefined();
});
it('leaves the editor visible if the sharing picker is cancelled',async()=>{
  const ready=vi.fn(),getDisplayMedia=vi.fn().mockRejectedValue(new DOMException('Cancelled','NotAllowedError'));
  vi.stubGlobal('navigator',{mediaDevices:{getDisplayMedia}});
  await expect(captureTab('png',{width:1600,seconds:3,signal:new AbortController().signal,ready})).rejects.toMatchObject({name:'NotAllowedError'});
  expect(ready).not.toHaveBeenCalled();
  expect(getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({audio:false,preferCurrentTab:true}));
});
it('stops sharing if a window was selected instead of a tab',async()=>{
  const stop=vi.fn(),ready=vi.fn();const track={getSettings:()=>({displaySurface:'window'}),stop};
  vi.stubGlobal('navigator',{mediaDevices:{getDisplayMedia:async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]})}});
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  await expect(captureTab('png',{width:1600,seconds:3,signal:new AbortController().signal,ready})).rejects.toThrow('Choose this browser tab');
  expect(stop).toHaveBeenCalledOnce();expect(ready).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
