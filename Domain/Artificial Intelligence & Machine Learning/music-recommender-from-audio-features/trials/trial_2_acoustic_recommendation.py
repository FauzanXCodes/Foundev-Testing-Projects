import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


data = pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep=';')


# Create a DataFrame
df = pd.DataFrame(data)

# Select the song you want to find similar songs for
selected_song = {
    'title': 'Flowers',
    
}


# User Selects song by Title from database
select_song = str(input('Enter Song Title: '))
select_artist = str(input('Enter Artist Title: '))


# Make the 'title' column lowercase and the same type
df['title'] = df['title'].str.lower()

# Check if the selected song is in the DataFrame
if select_song.lower() in df['title'].values:
    # Convert the selected song to lowercase
    selected_song = {
        'title': select_song.lower()
    }
    print("Selected song:", selected_song)
else:
    print("Selected song not found in the database.")




# User Selects song by Title from database
select_song = str(input('Enter Song Title: '))

# Make the 'title' column lowercase and the same type
df['title'] = df['title'].str.lower()

# Check if the selected song is in the DataFrame
if select_song.lower() in df['title'].values:
    # Prompt the user to enter the artist
    select_artist = str(input('Enter Artist: '))

    # Make the 'artist' column lowercase and the same type
    df['artist'] = df['artist'].str.lower()

    # Check if the selected artist is in the DataFrame
    if select_artist.lower() in df['artist'].values:
        # Convert the selected song and artist to lowercase
        selected_song = {
            'title': select_song.lower(),
            'artist': select_artist.lower()
        }
        print("Selected song:", selected_song)
    else:
        print("Selected artist not found in the database.")
else:
    print("Selected song not found in the database.")


df[feature]


# Calculate cosine similarity for acoustic features
acoustic_features = ['bpm', 'energy', 'danceability ', 'dB', 'liveness', 'valence', 'duration', 'acousticness', 'speechiness ', 'popularity']

# Normalize acoustic features
for feature in acoustic_features:
    df[feature] = (df[feature] - df[feature].min()) / (df[feature].max() - df[feature].min())

# Create a vector for the selected song
selected_song_vector = df[df['title'] == selected_song['title']][acoustic_features].values

df['similarity'] = cosine_similarity(df[acoustic_features], selected_song_vector).flatten()

recommended_songs = df.sort_values(by='similarity', ascending=False)[['title', 'artist', 'similarity']]

df.sort_values(by='similarity', ascending=False)[['title']]


cosine_similarity(df[acoustic_features], selected_song_vector).flatten()


df[acoustic_features]


df[df['title'] == selected_song['title']][acoustic_features]


acoustic_features = ['bpm', 'energy', 'danceability ', 'dB', 'liveness', 'valence', 'duration', 'acousticness', 'speechiness ', 'popularity']

# Normalize acoustic features
for feature in acoustic_features:
    df[feature] = (df[feature] - df[feature].min()) / (df[feature].max() - df[feature].min())
   

df[feature]

acoustic_features = ['bpm', 'energy', 'danceability ', 'dB', 'liveness', 'valence', 'duration', 'acousticness', 'speechiness ']

for feature in acoustic_features: 
    print(feature)


(df[feature] - df[feature].min()) / (df[feature].max() - df[feature].min())


df[feature]


(df[feature] - df[feature].min())


(df[feature].max() - df[feature].min())


for feature in acoustic_features: 
    print(acoustic_features)


selected_song['title']


df[df['title'] == selected_song['title']][acoustic_features]






