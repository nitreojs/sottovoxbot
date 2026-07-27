# sottovoxbot

a telegram bot that allows you to send a private message to a certain user and no one except them will be able to read it. inline whispers can also be sent as one-time reads that burn once opened.

whisper bodies are encrypted before they reach redis: the key is derived from `WHISPER_SECRET` and from key material that only ever lives in the message's button, so a redis dump on its own decrypts nothing.

you will need a redis instance running.

powered by [puregram](https://puregram.cool).

## installing

##### yarn

```sh
yarn
```

##### npm

```sh
npm install
```

rename `.env.example` to `.env` and fill in the required environment variables.

## running

##### yarn

```sh
yarn dev
```

##### npm

```sh
npm run dev
```

## building

##### yarn

```sh
yarn build
```

##### npm

```sh
npm run build
```

---

<div align="center">

it's that simple!

<b>made by [starkow](https://starkow.dev)</b>

</div>
