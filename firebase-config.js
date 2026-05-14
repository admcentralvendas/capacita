const firebaseConfig = {
  apiKey: "AIzaSyD9PHSwHe53cWgBqadBnVwcDCV_BYlRVyg",
  authDomain: "gestaopessoas-54c2a.firebaseapp.com",
  projectId: "gestaopessoas-54c2a",
  storageBucket: "gestaopessoas-54c2a.firebasestorage.app",
  messagingSenderId: "747016841294",
  appId: "1:747016841294:web:fb2ca33e36743a27653b1f"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}