test "basic casefold operations" {
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

test "empty string" {
  assert_eq(@casefold.casefold(""), "")
}

test "single character - lowercase" {
  assert_eq(@casefold.casefold("a"), "a")
  assert_eq(@casefold.casefold("z"), "z")
}

test "single character - uppercase" {
  assert_eq(@casefold.casefold("A"), "a")
  assert_eq(@casefold.casefold("Z"), "z")
}

test "already lowercase string" {
  assert_eq(@casefold.casefold("hello world"), "hello world")
  assert_eq(@casefold.casefold("moonbit"), "moonbit")
}

test "mixed case string" {
  assert_eq(@casefold.casefold("Hello World"), "hello world")
  assert_eq(@casefold.casefold("MoonBit"), "moonbit")
}

test "ASCII uppercase to lowercase" {
  assert_eq(@casefold.casefold("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), "abcdefghijklmnopqrstuvwxyz")
}

test "Latin extended - basic" {
  assert_eq(@casefold.casefold("ÀÁÂÃÄÅÆÇÈÉÊË"), "àáâãäåæçèéêë")
  assert_eq(@casefold.casefold("ÌÍÎÏÐÑÒÓÔÕÖ"), "ìíîïðñòóôõö")
}

test "Greek alphabet" {
  assert_eq(@casefold.casefold("ΑΒΓΔΕΖΗΘ"), "αβγδεζηθ")
  assert_eq(@casefold.casefold("ΙΚΛΜΝΞΟΠ"), "ικλμνξοπ")
  assert_eq(@casefold.casefold("Σ"), "σ")
}

test "Cyrillic alphabet" {
  assert_eq(@casefold.casefold("АБВГДЕЁЖЗ"), "абвгдеёжз")
  assert_eq(@casefold.casefold("ИЙКЛМНОПР"), "ийклмнопр")
}

test "special one-to-two mappings" {
  assert_eq(@casefold.casefold("ß"), "ss")
  assert_eq(@casefold.casefold("ﬀ"), "ff")
  assert_eq(@casefold.casefold("ﬁ"), "fi")
  assert_eq(@casefold.casefold("ﬂ"), "fl")
  assert_eq(@casefold.casefold("ﬆ"), "st")
}

test "special one-to-three mappings" {
  assert_eq(@casefold.casefold("ﬃ"), "ffi")
  assert_eq(@casefold.casefold("ﬄ"), "ffl")
}

test "Turkish I with dot" {
  assert_eq(@casefold.casefold("İ"), "i\u{0307}")
}

test "casefold_char function" {
  let result = @casefold.casefold_char('A')
  assert_eq(result.collect(), ['a'])
  
  let result_german = @casefold.casefold_char('ß')
  assert_eq(result_german.collect(), ['s', 's'])
}

test "idempotency - casefold is idempotent" {
  let test_strings = ["Hello", "WORLD", "ß", "İ", "ΑΒΓΔ", "АБВГД"]
  for str in test_strings {
    let once = @casefold.casefold(str)
    let twice = @casefold.casefold(once)
    assert_eq(once, twice)
  }
}

test "consistency across different representations" {
  let k1 = Int::unsafe_to_char(0x212A)
  let k2 = Int::unsafe_to_char(0x004B)
  assert_eq(
    @casefold.casefold(k1.to_string()),
    @casefold.casefold(k2.to_string()),
  )
  
  let ohm = Int::unsafe_to_char(0x2126)
  let omega = Int::unsafe_to_char(0x03A9)
  assert_eq(
    @casefold.casefold(ohm.to_string()),
    @casefold.casefold(omega.to_string()),
  )
}

test "numbers and symbols unchanged" {
  assert_eq(@casefold.casefold("0123456789"), "0123456789")
  assert_eq(@casefold.casefold("!@#$%^&*()"), "!@#$%^&*()")
  assert_eq(@casefold.casefold("+-*/=<>"), "+-*/=<>")
}

test "whitespace preserved" {
  assert_eq(@casefold.casefold("Hello World"), "hello world")
  assert_eq(@casefold.casefold("A\tB\nC\rD"), "a\tb\nc\rd")
}

test "long string" {
  let input = "The Quick Brown Fox Jumps Over The Lazy Dog"
  let expected = "the quick brown fox jumps over the lazy dog"
  assert_eq(@casefold.casefold(input), expected)
}

test "Armenian alphabet" {
  assert_eq(@casefold.casefold("ԱԲԳԴԵԶԷԸ"), "աբգդեզէը")
}

test "Georgian alphabet" {
  let upper = Int::unsafe_to_char(0x10A0).to_string() + 
              Int::unsafe_to_char(0x10A1).to_string() +
              Int::unsafe_to_char(0x10A2).to_string()
  let lower = Int::unsafe_to_char(0x2D00).to_string() + 
              Int::unsafe_to_char(0x2D01).to_string() +
              Int::unsafe_to_char(0x2D02).to_string()
  assert_eq(@casefold.casefold(upper), lower)
}
