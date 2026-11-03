"""Tests for rolling premium FC ARENA image assets."""
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import fill_queue

class QueueTests(unittest.TestCase):
    def test_future_date_generation_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            old=fill_queue.MEDIA
            try:
                fill_queue.MEDIA=Path(tmp)
                created=fill_queue.build_queue(date(2026,11,3),days=2,max_new=1)
                self.assertEqual(len(created),1)
                self.assertEqual(created[0].name,"2026-11-04.jpg")
                with Image.open(created[0]) as image:
                    self.assertEqual(image.format,"JPEG")
                    self.assertEqual(image.size,(1080,1350))
                    self.assertGreater(created[0].stat().st_size,20000)
                created_again=fill_queue.build_queue(date(2026,11,3),days=1,max_new=1)
                self.assertEqual(created_again,[])
            finally:
                fill_queue.MEDIA=old

if __name__=="__main__":
    unittest.main()
