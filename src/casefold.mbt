///|
pub fn casefold(s : String) -> String {
  let str_buf = StringBuilder::new(size_hint=s.length())
  for c in s.iter() {
    match lookup(c) {
      One(c) => str_buf.write_char(c)
      Two(c1, c2) => {
        str_buf.write_char(c1)
        str_buf.write_char(c2)
      }
      Three(c1, c2, c3) => {
        str_buf.write_char(c1)
        str_buf.write_char(c2)
        str_buf.write_char(c3)
      }
    }
  } else {
    str_buf.to_string()
  }
}
