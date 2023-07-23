import datetime
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('frost-children-firebase-adminsdk.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

# goal is to take the data from the firestore collection and put it into a sql database

fb_collection = db.collection('promote-it-on-abrys-fam-bot')

fb_docs = fb_collection.stream()

sql_statements = []

for fb_doc in fb_docs:
    fb_data = fb_doc.to_dict()
    fb_doc_creation_time = fb_doc.create_time
    formatted_time = fb_doc_creation_time.strftime('%Y-%m-%d %H:%M:%S')    
    fb_doc_image_name = fb_doc.id[fb_doc.id.index('_')+1:]
    print(f"Migrating {fb_data['discord_user']}'s {fb_doc_image_name}")

    sql_statements.append(f"INSERT INTO promote_it_on_abrys_fam_bot (discord_user, image_url, ig_post_code, promoted_on_insta) VALUES ('{fb_data.get('discord_user', '')}', '{fb_data.get('image_url', '')}', '{fb_data.get('ig_post_code', '')}', {fb_data.get('promoted_on_insta', False)});")

with open('to_sql.sql', 'w') as f:
    for sql_statement in sql_statements:
        f.write(sql_statement + '\n')

print('Done!')