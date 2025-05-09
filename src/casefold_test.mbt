///|
test {
  inspect!(casefold("ß"), content="ss")
  inspect!(casefold("der Fluß"), content="der fluss")
  inspect!(casefold("İ"), content="i̇")
  let k1 = Char::from_int(0x212A)
  let k2 = Char::from_int(0x4B)
  inspect!(k1, content="K")
  inspect!(k2, content="K")
  assert_eq!(casefold(k1.to_string()), casefold(k2.to_string()))
}
