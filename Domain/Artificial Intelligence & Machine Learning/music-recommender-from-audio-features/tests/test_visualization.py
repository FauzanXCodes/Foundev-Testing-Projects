import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Configure Dataset
data = pd.read_csv('Best Songs on Spotify from 2000-2023.csv', sep = ";")
df = pd.DataFrame(data)
df = df.drop_duplicates(subset=["title"],keep="first")

df['title'] = df['title'].str.lower()
df['artist'] = df['artist'].str.lower()

# Count the number of popular songs for each artist and select the top 20
popular_songs_count = df['artist'].value_counts().head(20)

# Create a new figure for the bar plot with specified dimensions
plt.figure(figsize=(9, 6))

# Count popular songs on the x-axis and the artist names on the y-axis
sns.barplot(x=popular_songs_count.values, y=popular_songs_count.index, palette='deep')

# Add a title to the plot
plt.title('Number of Popular Songs by Top 20 Artists on Spotify from 2000-2023', fontsize=14)



