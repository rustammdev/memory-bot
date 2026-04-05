UPDATE videos SET
  thumbnail_default = 'https://img.youtube.com/vi/' || youtube_video_id || '/default.jpg',
  thumbnail_medium  = 'https://img.youtube.com/vi/' || youtube_video_id || '/mqdefault.jpg',
  thumbnail_high    = 'https://img.youtube.com/vi/' || youtube_video_id || '/hqdefault.jpg',
  thumbnail_maxres  = 'https://img.youtube.com/vi/' || youtube_video_id || '/maxresdefault.jpg'
WHERE thumbnail_default IS NULL;
