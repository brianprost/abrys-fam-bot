import datetime
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('frost-children-firebase-adminsdk.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

old_collection_ref = db.collection('discord/bots/promote-it-on-abrys-fam')

old_docs = old_collection_ref.stream()

for old_doc in old_docs:
    old_data = old_doc.to_dict()
    old_doc_creation_time = old_doc.create_time
    formatted_time = old_doc_creation_time.strftime('%Y-%m-%d %H:%M:%S')    
    old_doc_image_name = old_doc.id[old_doc.id.index('_')+1:]
    print(f"Migrating {old_data['discord_user']}'s {old_doc_image_name}")

    new_data = {
        'discord_user': old_data['discord_user'],
        'image_url': old_data['image_url'],
    }

    if 'ig_post_code' in old_data:
        new_data['ig_post_code'] = old_data['ig_post_code']
    
    if 'promoted_on_abrys_fam' in old_data:
        new_data['promoted_on_insta']: old_data['promoted_on_abrys_fam']

    new_doc_id = f"{formatted_time}_{old_data['discord_user']}_{old_doc_image_name}"

    new_doc_ref = db.collection('promote-it-on-abrys-fam-bot').document(new_doc_id)

    new_doc_ref.set(new_data)

    old_doc.reference.delete()

