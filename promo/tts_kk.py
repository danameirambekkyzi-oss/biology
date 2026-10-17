import sherpa_onnx, soundfile as sf, sys, numpy as np
M='vits-piper-kk_KZ-issai-high/'
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=M+'kk_KZ-issai-high.onnx',tokens=M+'tokens.txt',data_dir=M+'espeak-ng-data'),num_threads=4))
tts=sherpa_onnx.OfflineTts(cfg)
def say(text,sid,speed,out):
    a=tts.generate(text,sid=sid,speed=speed); sf.write(out,np.array(a.samples),a.sample_rate); return len(a.samples)/a.sample_rate
if __name__=='__main__':
    for sid in (2,3,4,5):
        print(sid, say("Сәлем! Бұл Био ҰБТ — биологиядан ҰБТ-ға дайындық платформасы.",sid,1.0,f's{sid}.wav'))
