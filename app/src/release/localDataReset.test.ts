import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetAetherLocalData } from './localDataReset';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///aether-docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  deleteAsync: jest.fn(),
}));

beforeEach(() => AsyncStorage.clear());

describe('local data reset', () => {
  it('removes Aether-owned local data keys and leaves unrelated keys alone', async () => {
    await AsyncStorage.setItem('@aether/legal_acceptance', 'x');
    await AsyncStorage.setItem('@aether/conversation/1', 'x');
    await AsyncStorage.setItem('aether_second_brain', 'x');
    await AsyncStorage.setItem('unrelated', 'x');

    await resetAetherLocalData();

    expect(await AsyncStorage.getItem('@aether/legal_acceptance')).toBeNull();
    expect(await AsyncStorage.getItem('@aether/conversation/1')).toBeNull();
    expect(await AsyncStorage.getItem('aether_second_brain')).toBeNull();
    expect(await AsyncStorage.getItem('unrelated')).toBe('x');
  });
});

