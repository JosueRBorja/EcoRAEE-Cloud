import sqlite3
from contextlib import closing
import tempfile
import unittest
from pathlib import Path
from scripts.respaldo import create_backup, restore_backup


class BackupTests(unittest.TestCase):
    def test_database_and_media_recover_together_without_overwriting(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            database = root/'original.db'
            with closing(sqlite3.connect(database)) as db, db:
                db.execute('CREATE TABLE sample(id INTEGER PRIMARY KEY,value TEXT)')
                db.execute("INSERT INTO sample VALUES (1,'Información persistente')")
            uploads, media = root/'uploads', root/'media'
            uploads.mkdir(); media.mkdir()
            (uploads/'acta.pdf').write_bytes(b'%PDF-acta')
            (media/'foto.jpg').write_bytes(b'foto-sintetica')
            archive, target = root/'respaldo.zip', root/'recuperado'
            create_backup(archive,database,uploads,media)
            self.assertEqual(restore_backup(archive,target),3)
            with closing(sqlite3.connect(target/'ecoraee.db')) as db:
                self.assertEqual(db.execute('SELECT value FROM sample').fetchone()[0],'Información persistente')
            self.assertEqual((target/'media/foto.jpg').read_bytes(),b'foto-sintetica')
            with self.assertRaises(ValueError): restore_backup(archive,target)
            with self.assertRaises(ValueError): create_backup(archive,database,uploads,media)
