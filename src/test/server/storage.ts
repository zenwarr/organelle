import {expect} from 'chai';
import {Storage, MAX_STORAGE_VERSION} from '../../server/storage/storage'

const TEST_UUID = '783ce831-c448-4f7a-ada1-b704e3d064b4';

describe('Storage', function() {
  describe('isValidConfig', function() {
    it('should reject incorrect version', function() {
      let conf = {
        version: '' + (MAX_STORAGE_VERSION + 1),
        public_config: {
          uuid: TEST_UUID,
          title: 'test library'
        }
      };

      expect(Storage.isValidConfig(conf)).instanceOf(Error);
    });

    it('should reject a lib without UUID', function() {
      let conf = {
        version: '' + MAX_STORAGE_VERSION,
        public_config: {

        }
      };

      expect(Storage.isValidConfig(conf)).instanceOf(Error);
    });

    it('should accept minimal valid config', function() {
      let conf = {
        version: '' + MAX_STORAGE_VERSION,
        public_config: {
          uuid: TEST_UUID
        }
      };

      expect(Storage.isValidConfig(conf)).is.null;
    });
  });
});
