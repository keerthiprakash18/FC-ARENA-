import { describe, expect, it } from 'vitest';
import { largestTextBand } from './providers/tesseract-ocr.provider.js';

describe('Score layout recovery when OCR emits no digits',()=>{
  it('finds the large separated text band while ignoring a clock and small statistic rows',()=>{
    const width=400,height=300,pixels=Buffer.alloc(width*height,255);
    for(const [top,bottom] of [[10,18],[55,70],[110,155],[220,230]])
      for(let y=top;y<bottom;y++)for(let x=170;x<200;x++)pixels[y*width+x]=0;
    expect(largestTextBand(pixels,width,height)).toEqual({top:110,bottom:155});
  });
  it('does not invent a score region for blank or solid screenshots',()=>{
    expect(largestTextBand(Buffer.alloc(400*300,255),400,300)).toBeNull();
    expect(largestTextBand(Buffer.alloc(400*300,0),400,300)).toBeNull();
  });
});
