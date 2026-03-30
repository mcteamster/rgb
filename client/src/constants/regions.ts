export const AWS_REGIONS = {
  'ap-southeast-2': 'AU',
  'ap-northeast-1': 'JP', 
  'ap-southeast-1': 'SG',
  'ap-south-1': 'IN',
  'eu-central-1': 'EU',
  'eu-west-2': 'UK',
  'sa-east-1': 'BR',
  'us-east-1': 'USE',
  'us-west-2': 'USW',
};

export const API_BASE_URL = 'https://api.ohnomer.com';

export const ENDPOINTS = {
  'AU': 'wss://au.rgb.mcteamster.com',
  'JP': 'wss://jp.rgb.mcteamster.com',
  'SG': 'wss://sg.rgb.mcteamster.com',
  'IN': 'wss://in.rgb.mcteamster.com',
  'EU': 'wss://eu.rgb.mcteamster.com',
  'UK': 'wss://uk.rgb.mcteamster.com',
  'BR': 'wss://br.rgb.mcteamster.com',
  'USE': 'wss://use.rgb.mcteamster.com',
  'USW': 'wss://usw.rgb.mcteamster.com',
  'TEST': 'wss://test.rgb.mcteamster.com',
  'DEFAULT': 'wss://au.rgb.mcteamster.com'
};

export const FLAGS = {
  'AU': '🇦🇺',
  'JP': '🇯🇵',
  'SG': '🇸🇬',
  'IN': '🇮🇳',
  'EU': '🇪🇺',
  'UK': '🇬🇧',
  'BR': '🇧🇷',
  'USE': '🇺🇸',
  'USW': '🇺🇸',
  'TEST': '🇦🇺',
};

export const REGION_LABELS = {
  'AU': 'AU',
  'JP': 'JP',
  'SG': 'SG',
  'IN': 'IN',
  'EU': 'EU',
  'UK': 'UK',
  'BR': 'BR',
  'USE': 'US East',
  'USW': 'US West',
  'TEST': 'Test',
};

export const getRegionFromCode = (roomCode: string): string => {
  const lastLetter = roomCode[roomCode.length - 1].toUpperCase();
  
  if ('BC'.includes(lastLetter)) {
    return 'AU'; // Australia 🇦🇺
  } else if ('DF'.includes(lastLetter)) {
    return 'JP'; // Japan 🇯🇵
  } else if ('GH'.includes(lastLetter)) {
    return 'SG'; // Singapore 🇸🇬
  } else if ('JK'.includes(lastLetter)) {
    return 'IN'; // India 🇮🇳
  } else if ('LM'.includes(lastLetter)) {
    return 'EU'; // Europe 🇪🇺
  } else if ('NP'.includes(lastLetter)) {
    return 'UK'; // UK 🇬🇧
  } else if ('QR'.includes(lastLetter)) {
    return 'BR'; // Brazil 🇧🇷
  } else if ('ST'.includes(lastLetter)) {
    return 'USE'; // US East 🇺🇸
  } else if ('VW'.includes(lastLetter)) {
    return 'USW'; // US West 🇺🇸
  } else if ('XZ'.includes(lastLetter)) {
    return 'TEST'; // Test (Melbourne) 🇦🇺
  } else {
    return 'AU'; // Default fallback
  }
};
