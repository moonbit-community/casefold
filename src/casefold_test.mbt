///|
test {
  inspect(@casefold.casefold("ß"), content="ss")
  inspect(@casefold.casefold("der Fluß"), content="der fluss")
  inspect(@casefold.casefold("İ"), content="i̇")
  let k1 = Int::unsafe_to_char(0x212A)
  let k2 = Int::unsafe_to_char(0x4B)
  inspect(k1, content="K")
  inspect(k2, content="K")
  assert_eq(
    @casefold.casefold(k1.to_string()),
    @casefold.casefold(k2.to_string()),
  )
}
