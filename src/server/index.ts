import {Storage} from './storage/storage';

Storage.load('./demo/organica_lib').then((stor: Storage) => {
  console.log(stor.rawConfig);
  console.log(stor.title);
}, (err: Error) => {
  console.log(err);
});
