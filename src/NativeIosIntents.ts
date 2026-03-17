import { NitroModules } from 'react-native-nitro-modules';
import { Platform } from 'react-native';
import type { IosIntents as IIosIntents } from './IosIntents.nitro';

/**
 * Shared IosIntents native module singleton.
 *
 * IMPORTANT: Only one instance must exist — creating multiple via
 * createHybridObject would produce separate Swift objects with
 * separate callback registrations, breaking event routing.
 */
export const IosIntentsModule: IIosIntents | null =
  Platform.OS === 'ios'
    ? NitroModules.createHybridObject<IIosIntents>('IosIntents')
    : null;
