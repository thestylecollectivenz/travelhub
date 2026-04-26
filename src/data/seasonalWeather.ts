export interface SeasonalMonthProfile {
  tempRange: string;
  conditions: string;
  daylight: string;
}

export const SEASONAL_BY_REGION: Record<string, Record<number, SeasonalMonthProfile>> = {
  'Western Europe': {
    0: { tempRange: '2-8°C', conditions: 'Cold, frequent rain', daylight: '8-9h' },
    1: { tempRange: '3-9°C', conditions: 'Cool, cloudy', daylight: '9-10h' },
    2: { tempRange: '5-12°C', conditions: 'Mild, mixed sun/rain', daylight: '11-12h' },
    3: { tempRange: '8-16°C', conditions: 'Spring showers', daylight: '13-14h' },
    4: { tempRange: '11-20°C', conditions: 'Mild and greener', daylight: '15h' },
    5: { tempRange: '14-23°C', conditions: 'Warm, pleasant', daylight: '16h' },
    6: { tempRange: '16-26°C', conditions: 'Warmest period', daylight: '15-16h' },
    7: { tempRange: '16-25°C', conditions: 'Warm, occasional storms', daylight: '14h' },
    8: { tempRange: '13-22°C', conditions: 'Late-summer mild', daylight: '12-13h' },
    9: { tempRange: '10-17°C', conditions: 'Cooler, wetter', daylight: '10-11h' },
    10: { tempRange: '6-12°C', conditions: 'Cool and damp', daylight: '8-9h' },
    11: { tempRange: '3-9°C', conditions: 'Cold, overcast', daylight: '8h' }
  },
  'Southern Europe': {
    0: { tempRange: '7-14°C', conditions: 'Cool and mild', daylight: '9-10h' },
    1: { tempRange: '8-15°C', conditions: 'Mild, occasional rain', daylight: '10-11h' },
    2: { tempRange: '10-18°C', conditions: 'Pleasant spring', daylight: '12h' },
    3: { tempRange: '13-21°C', conditions: 'Warmer, sunny spells', daylight: '13-14h' },
    4: { tempRange: '17-26°C', conditions: 'Warm and dry', daylight: '14-15h' },
    5: { tempRange: '21-31°C', conditions: 'Hot, mostly dry', daylight: '15h' },
    6: { tempRange: '24-34°C', conditions: 'Peak heat', daylight: '14-15h' },
    7: { tempRange: '24-34°C', conditions: 'Hot, dry coast', daylight: '13-14h' },
    8: { tempRange: '20-29°C', conditions: 'Warm late summer', daylight: '12-13h' },
    9: { tempRange: '16-24°C', conditions: 'Pleasant autumn', daylight: '11h' },
    10: { tempRange: '11-18°C', conditions: 'Cooler, some rain', daylight: '10h' },
    11: { tempRange: '8-15°C', conditions: 'Mild winter', daylight: '9h' }
  },
  'Southeast Asia': {
    0: { tempRange: '24-31°C', conditions: 'Warm, generally drier', daylight: '11-12h' },
    1: { tempRange: '25-32°C', conditions: 'Hot and humid', daylight: '12h' },
    2: { tempRange: '26-33°C', conditions: 'Hotter, rising humidity', daylight: '12h' },
    3: { tempRange: '26-34°C', conditions: 'Heat + pre-monsoon storms', daylight: '12h' },
    4: { tempRange: '26-33°C', conditions: 'Monsoon onset in many areas', daylight: '12-13h' },
    5: { tempRange: '25-32°C', conditions: 'Wet season common', daylight: '12-13h' },
    6: { tempRange: '25-31°C', conditions: 'Wet and humid', daylight: '12-13h' },
    7: { tempRange: '25-31°C', conditions: 'Frequent showers', daylight: '12h' },
    8: { tempRange: '25-31°C', conditions: 'Wet season tapering in some areas', daylight: '12h' },
    9: { tempRange: '25-31°C', conditions: 'Mixed sun and rain', daylight: '12h' },
    10: { tempRange: '24-31°C', conditions: 'Transition to drier', daylight: '11-12h' },
    11: { tempRange: '24-31°C', conditions: 'Drier season in many regions', daylight: '11-12h' }
  },
  'East Asia': {
    0: { tempRange: '-2-8°C', conditions: 'Cold in north, cool in south', daylight: '9-10h' },
    1: { tempRange: '0-10°C', conditions: 'Late winter, dry', daylight: '10-11h' },
    2: { tempRange: '5-15°C', conditions: 'Spring warming', daylight: '12h' },
    3: { tempRange: '10-21°C', conditions: 'Mild spring', daylight: '13h' },
    4: { tempRange: '15-26°C', conditions: 'Warm, humid building', daylight: '14h' },
    5: { tempRange: '20-30°C', conditions: 'Summer monsoon onset', daylight: '14-15h' },
    6: { tempRange: '24-33°C', conditions: 'Hot, humid', daylight: '14h' },
    7: { tempRange: '24-33°C', conditions: 'Hot, storm risk', daylight: '13h' },
    8: { tempRange: '19-28°C', conditions: 'Late summer, typhoon risk', daylight: '12h' },
    9: { tempRange: '13-22°C', conditions: 'Cooler and clearer', daylight: '11h' },
    10: { tempRange: '6-15°C', conditions: 'Crisp autumn', daylight: '10h' },
    11: { tempRange: '0-10°C', conditions: 'Early winter', daylight: '9-10h' }
  },
  'North America': {
    0: { tempRange: '-5-6°C', conditions: 'Winter cold (varies by region)', daylight: '9-10h' },
    1: { tempRange: '-2-8°C', conditions: 'Late winter', daylight: '10-11h' },
    2: { tempRange: '3-14°C', conditions: 'Early spring', daylight: '12h' },
    3: { tempRange: '8-20°C', conditions: 'Mild spring', daylight: '13-14h' },
    4: { tempRange: '13-25°C', conditions: 'Warm spring', daylight: '14-15h' },
    5: { tempRange: '18-30°C', conditions: 'Summer starts', daylight: '15h' },
    6: { tempRange: '21-33°C', conditions: 'Peak summer heat', daylight: '14-15h' },
    7: { tempRange: '20-32°C', conditions: 'Warm to hot', daylight: '13-14h' },
    8: { tempRange: '16-27°C', conditions: 'Late summer', daylight: '12-13h' },
    9: { tempRange: '10-20°C', conditions: 'Autumn cooling', daylight: '11h' },
    10: { tempRange: '3-13°C', conditions: 'Late autumn', daylight: '10h' },
    11: { tempRange: '-2-8°C', conditions: 'Winter onset', daylight: '9h' }
  },
  'Australia/NZ': {
    0: { tempRange: '19-30°C', conditions: 'Summer warmth', daylight: '14h' },
    1: { tempRange: '18-29°C', conditions: 'Late summer', daylight: '13h' },
    2: { tempRange: '16-26°C', conditions: 'Early autumn', daylight: '12h' },
    3: { tempRange: '13-23°C', conditions: 'Autumn mild', daylight: '11h' },
    4: { tempRange: '10-20°C', conditions: 'Cooler, more fronts', daylight: '10h' },
    5: { tempRange: '8-18°C', conditions: 'Winter in south', daylight: '9-10h' },
    6: { tempRange: '7-17°C', conditions: 'Coolest period', daylight: '9-10h' },
    7: { tempRange: '8-19°C', conditions: 'Late winter', daylight: '10-11h' },
    8: { tempRange: '10-21°C', conditions: 'Spring warming', daylight: '11-12h' },
    9: { tempRange: '12-24°C', conditions: 'Mild spring', daylight: '12-13h' },
    10: { tempRange: '15-27°C', conditions: 'Early summer', daylight: '13-14h' },
    11: { tempRange: '17-29°C', conditions: 'Summer', daylight: '14h' }
  },
  'Middle East': {
    0: { tempRange: '12-22°C', conditions: 'Mild winter', daylight: '10-11h' },
    1: { tempRange: '14-24°C', conditions: 'Pleasant', daylight: '11h' },
    2: { tempRange: '18-29°C', conditions: 'Warming quickly', daylight: '12h' },
    3: { tempRange: '23-35°C', conditions: 'Hot spring', daylight: '13h' },
    4: { tempRange: '28-40°C', conditions: 'Very hot', daylight: '13-14h' },
    5: { tempRange: '31-43°C', conditions: 'Peak heat', daylight: '14h' },
    6: { tempRange: '33-45°C', conditions: 'Extreme heat', daylight: '13-14h' },
    7: { tempRange: '33-45°C', conditions: 'Very hot and dry', daylight: '13h' },
    8: { tempRange: '30-41°C', conditions: 'Still very hot', daylight: '12-13h' },
    9: { tempRange: '25-36°C', conditions: 'Cooling trend', daylight: '11-12h' },
    10: { tempRange: '19-29°C', conditions: 'Warm and pleasant', daylight: '10-11h' },
    11: { tempRange: '14-24°C', conditions: 'Mild winter', daylight: '10h' }
  },
  Caribbean: {
    0: { tempRange: '24-29°C', conditions: 'Warm, breezy', daylight: '11h' },
    1: { tempRange: '24-29°C', conditions: 'Dry season', daylight: '11-12h' },
    2: { tempRange: '25-30°C', conditions: 'Sunny, warm', daylight: '12h' },
    3: { tempRange: '26-31°C', conditions: 'Warmer, humid', daylight: '12-13h' },
    4: { tempRange: '27-31°C', conditions: 'Humidity rising', daylight: '13h' },
    5: { tempRange: '27-32°C', conditions: 'Wet season begins', daylight: '13h' },
    6: { tempRange: '27-32°C', conditions: 'Hot, tropical showers', daylight: '13h' },
    7: { tempRange: '27-32°C', conditions: 'Hurricane season risk', daylight: '12-13h' },
    8: { tempRange: '27-32°C', conditions: 'Peak storm season risk', daylight: '12h' },
    9: { tempRange: '27-31°C', conditions: 'Humid, storm risk', daylight: '12h' },
    10: { tempRange: '26-30°C', conditions: 'Late wet season', daylight: '11h' },
    11: { tempRange: '25-29°C', conditions: 'Drier again', daylight: '11h' }
  }
};
